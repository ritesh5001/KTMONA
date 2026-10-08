import SupportChat from "@/components/support/support-chat";

export const metadata = {
  title: "Support Inbox | KTMONA Admin",
};

export default function AdminSupportPage() {
  return (
    <SupportChat
      audience="admin"
      title="Support Inbox"
      description="Every request raised by customers and sellers. Replies are delivered instantly to their app."
    />
  );
}
