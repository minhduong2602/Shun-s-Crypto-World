import { NextRequest, NextResponse } from 'next/server';
import { requireUser, UnauthorizedError } from '@/lib/auth/require-user';
import { getServerSupabase } from '@/lib/supabase/server';
import { ChainType } from '@/lib/types';
import { validateAddress } from '@/lib/wallets/validate-address';
import { PublicWalletIndexer } from '@/lib/providers/public-wallet-indexer';
import { mapWalletRow, normalizeWalletAddress } from '@/lib/wallets/wallet-repository';
import { syncWalletAssets, type WalletDatabaseClient } from '@/lib/wallets/wallet-sync-service';

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from('wallets')
      .select('*, wallet_assets(*)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const wallets = ((data ?? []) as unknown as Record<string, unknown>[]).map(mapWalletRow);
    const totalWalletBalance = wallets.reduce((acc, w) => acc + w.balanceUsd, 0);

    return NextResponse.json({
      wallets,
      totalWalletBalance: Number(totalWalletBalance.toFixed(2)),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để xem danh sách ví' }, { status: 401 });
    return NextResponse.json({ error: 'Lỗi tải danh sách ví: ' + String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { chain, address, label } = body;

    if (!chain || !address || !label) {
      return NextResponse.json(
        { error: 'Vui lòng cung cấp mạng blockchain, địa chỉ ví và tên nhãn gợi nhớ' },
        { status: 400 }
      );
    }

    const trimmed = address.trim();

    // Strict address validation
    const validation = validateAddress(chain as ChainType, trimmed);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Security check: Reject private keys (e.g. 64-char hex without 0x or 66-char starting with 0x that isn't address)
    if (trimmed.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return NextResponse.json(
        { error: 'CẢNH BÁO BẢO MẬT: Chuỗi bạn nhập trông giống Private Key! Tuyệt đối không bao giờ nhập Private Key vào bất kỳ đâu. Chỉ nhập Public Address.' },
        { status: 400 }
      );
    }

    const selectedChain = chain as ChainType;
    const supabase = await getServerSupabase();
    const { data: created, error: createError } = await supabase
      .from('wallets')
      .insert({
        owner_id: user.id,
        chain: selectedChain,
        address: trimmed,
        address_normalized: normalizeWalletAddress(selectedChain, trimmed),
        label: label.trim(),
        native_symbol: selectedChain === 'BTC' ? 'BTC' : selectedChain === 'SOL' ? 'SOL' : selectedChain === 'BSC' ? 'BNB' : 'ETH',
      })
      .select('*')
      .single();
    if (createError || !created) throw createError ?? new Error('Không thể tạo ví theo dõi');

    let scanWarning: string | undefined;
    let summary: Awaited<ReturnType<typeof syncWalletAssets>> | undefined;
    try {
      summary = await syncWalletAssets({
        client: supabase as unknown as WalletDatabaseClient,
        indexer: new PublicWalletIndexer(),
        ownerId: user.id,
        wallet: { id: String((created as { id: string }).id), chain: selectedChain, address: trimmed },
      });
    } catch (error) {
      // Keep the explicitly requested watch-only wallet, but report that its initial scan failed.
      // The sync run stores the provider error so the user can retry after fixing configuration.
      scanWarning = error instanceof Error ? error.message : String(error);
    }
    const { data: hydrated, error: hydrateError } = await supabase
      .from('wallets')
      .select('*, wallet_assets(*)')
      .eq('id', String((created as { id: string }).id))
      .single();
    if (hydrateError || !hydrated) throw hydrateError ?? new Error('Không thể tải ví vừa quét');
    const wallet = mapWalletRow(hydrated as unknown as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      wallet,
      message: scanWarning
        ? `Đã lưu ví theo dõi, nhưng lần quét đầu chưa thành công: ${scanWarning}. Hãy kiểm tra cấu hình nguồn dữ liệu rồi đồng bộ lại.`
        : `Đã kết nối ví chỉ xem! Quét được ${summary!.tokensCount} token. Tổng giá trị đã định giá: $${summary!.balanceUsd.toLocaleString()}`,
      scanWarning,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để theo dõi ví' }, { status: 401 });
    return NextResponse.json({ error: 'Lỗi thêm ví view-only: ' + String(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || body?.address;
      } catch {
        // body might be empty
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'Thiếu wallet ID hoặc địa chỉ ví' }, { status: 400 });
    }

    const supabase = await getServerSupabase();
    const { data, error } = await supabase.from('wallets').delete().eq('id', id).eq('owner_id', user.id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Không tìm thấy ví' }, { status: 404 });

    return NextResponse.json({ success: true, message: 'Đã xóa ví khỏi danh sách theo dõi thành công' });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Cần đăng nhập để xóa ví' }, { status: 401 });
    return NextResponse.json({ error: 'Lỗi xóa ví: ' + String(error) }, { status: 500 });
  }
}
