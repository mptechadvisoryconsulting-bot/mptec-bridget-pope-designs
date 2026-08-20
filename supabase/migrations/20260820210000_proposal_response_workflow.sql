alter table public.bpd_proposals
  drop constraint if exists bpd_proposals_status_check;

alter table public.bpd_proposals
  add constraint bpd_proposals_status_check
  check (
    status = any (
      array[
        'draft'::text,
        'sent'::text,
        'viewed'::text,
        'changes_requested'::text,
        'approved'::text,
        'rejected'::text,
        'expired'::text,
        'cancelled'::text
      ]
    )
  );
