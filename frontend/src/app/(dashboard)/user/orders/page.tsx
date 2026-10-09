import { cookies } from "next/headers";
import { readPortalSession } from "@/lib/session";
import UserOrdersClient, {
  type UserOrdersInitialData,
} from "./page.client";
import { listBuyerOrders } from "@/services/orders";
import { listMyCancellations } from "@/services/cancellations";
import { listMyReturns } from "@/services/returns";

export default async function UserOrdersPage() {
  const cookieStore = await cookies();
  const token =
    readPortalSession((name) => cookieStore.get(name)?.value, "user").access ?? null;

  if (!token) {
    return <UserOrdersClient initialData={null} />;
  }

  const [ordersResult, cancellationsResult, returnsResult] =
    await Promise.allSettled([
      listBuyerOrders(token),
      listMyCancellations(token),
      listMyReturns(token),
    ]);

  const orders =
    ordersResult.status === "fulfilled" ? ordersResult.value.orders ?? [] : [];

  const cancellationByOrderId: Record<string, { id: string; status: string }> =
    cancellationsResult.status === "fulfilled"
      ? (cancellationsResult.value.cancellations ?? []).reduce((acc, cancellation) => {
          acc[cancellation.orderId] = {
            id: cancellation.id,
            status: cancellation.status,
          };
          return acc;
        }, {} as Record<string, { id: string; status: string }>)
      : {};

  const returnByOrderId: Record<string, { id: string; status: string }> =
    returnsResult.status === "fulfilled"
      ? (returnsResult.value.returns ?? []).reduce((acc, ret) => {
          acc[ret.orderId] = { id: ret.id, status: ret.status };
          return acc;
        }, {} as Record<string, { id: string; status: string }>)
      : {};

  const paymentStatusByOrder = orders.reduce((acc, order: any) => {
    acc[order.id] = order.paymentStatus ?? "";
    return acc;
  }, {} as Record<string, string>);

  const initialData: UserOrdersInitialData = {
    orders,
    cancellationByOrderId,
    returnByOrderId,
    paymentStatusByOrder,
  };

  return <UserOrdersClient initialData={initialData} />;
}
