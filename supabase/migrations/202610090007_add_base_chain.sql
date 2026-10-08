-- Add Base as a supported EVM network for view-only wallet tracking.
alter type public.chain_type add value if not exists 'BASE';
