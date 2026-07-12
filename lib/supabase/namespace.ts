const tableAliases = {
  profiles: "bpd_profiles",
  leads: "bpd_leads",
  clients: "bpd_clients",
  projects: "bpd_projects",
  consultations: "bpd_consultations",
  proposals: "bpd_proposals",
  proposal_items: "bpd_proposal_items",
  contracts: "bpd_contracts",
  contract_signatures: "bpd_contract_signatures",
  invoices: "bpd_invoices",
  invoice_items: "bpd_invoice_items",
  invoice_templates: "bpd_invoice_templates",
  invoice_template_assets: "bpd_invoice_template_assets",
  invoice_versions: "bpd_invoice_versions",
  payments: "bpd_payments",
  stripe_events: "bpd_stripe_events",
  design_updates: "bpd_design_updates",
  milestones: "bpd_milestones",
  tasks: "bpd_tasks",
  inventory_items: "bpd_inventory_items",
  inventory_reservations: "bpd_inventory_reservations",
  calendar_events: "bpd_calendar_events",
  conversations: "bpd_conversations",
  files: "bpd_files",
  messages: "bpd_messages",
  notifications: "bpd_notifications",
  event_reminders: "bpd_event_reminders",
  activity_logs: "bpd_activity_logs",
  automation_logs: "bpd_automation_logs",
  business_settings: "bpd_business_settings",
} as const;

const bucketAliases = {
  "event-gallery": "bpd-event-gallery",
  "inquiry-pdfs": "bpd-inquiry-pdfs",
} as const;

export function mapSupabaseTable(table: string) {
  return tableAliases[table as keyof typeof tableAliases] ?? table;
}

export function mapSupabaseBucket(bucket: string) {
  return bucketAliases[bucket as keyof typeof bucketAliases] ?? bucket;
}

export function withBpdNamespace<TClient extends object>(client: TClient): TClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => (target as { from: (table: string) => unknown }).from(mapSupabaseTable(table));
      }

      if (prop === "storage") {
        const storage = Reflect.get(target, prop, receiver);

        if (!storage || typeof storage !== "object") {
          return storage;
        }

        return new Proxy(storage, {
          get(storageTarget, storageProp, storageReceiver) {
            if (storageProp === "from") {
              return (bucket: string) =>
                (storageTarget as unknown as { from: (bucket: string) => unknown }).from(mapSupabaseBucket(bucket));
            }

            const value = Reflect.get(storageTarget, storageProp, storageReceiver);
            return typeof value === "function" ? value.bind(storageTarget) : value;
          },
        });
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
