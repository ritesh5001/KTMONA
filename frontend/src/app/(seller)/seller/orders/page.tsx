import { cookies } from "next/headers";
import SellerOrdersClient, {
  type SellerOrdersInitialData,
} from "./page.client";
import { listSellerOrders } from "@/services/orders";
import { listSellerShipments } from "@/services/shipments";

function groupShipmentsByOrder(shipments: Array<any>): Record<string, Array<any>> {
  return shipments.reduce((acc, shipment) => {
    const orderId = shipment.orderId;
    acc[orderId] = acc[orderId] ? [...acc[orderId], shipment] : [shipment];
    return acc;
  }, {} as Record<string, Array<any>>);
}

export default async function SellerOrdersPage() {
  const token = (await cookies()).get("ktmona_access")?.value ?? null;

  if (!token) {
    return <SellerOrdersClient initialData={null} />;
  }

  const [ordersResult, shipmentsResult] = await Promise.allSettled([
    listSellerOrders(token),
    listSellerShipments(token),
  ]);

  const initialData: SellerOrdersInitialData = {
    orderItems:
      ordersResult.status === "fulfilled" ? ordersResult.value.orderItems ?? [] : [],
    shipmentsByOrder:
      shipmentsResult.status === "fulfilled"
        ? groupShipmentsByOrder(shipmentsResult.value.data?.shipments ?? [])
        : {},
  };

  return <SellerOrdersClient initialData={initialData} />;
}
