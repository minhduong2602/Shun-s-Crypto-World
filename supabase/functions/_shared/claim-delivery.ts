type AlertDeliveryClaimClient = {
  rpc(name: string, parameters: Record<string, string | number | null>): Promise<{ data: unknown; error: unknown | null }>;
};

export async function claimAlertDelivery(
  client: AlertDeliveryClaimClient,
  input: { ownerId: string; alertId: string; bucketKey: string; price: number; change24h: number | null },
) {
  const { data, error } = await client.rpc('claim_alert_delivery', {
    p_owner_id: input.ownerId,
    p_alert_id: input.alertId,
    p_bucket_key: input.bucketKey,
    p_observed_price_usd: input.price,
    p_observed_change_24h: input.change24h,
  });
  if (error) throw error;
  return data === true;
}
