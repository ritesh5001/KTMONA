import { redirect } from "next/navigation";

/** The store profile now lives in Settings. */
export default function SellerProfileRedirect() {
  redirect("/seller/settings");
}
