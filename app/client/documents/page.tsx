import { redirect } from "next/navigation";

export default function ClientDocumentsRedirectPage() {
  redirect("/client/files");
}
