"use client";

import * as React from "react";
import { QuickBuyDialog, type QuickBuyIntent } from "@/components/quick-buy-dialog";
import { CommerceFlowButton } from "@/components/ui/commerce-flow-button";

/**
 * Client island for the product card's Add to Cart.
 *
 * The card itself is a server component, so the dialog state lives here rather
 * than forcing the whole card — and the grid around it — onto the client.
 */
export function QuickBuyButton({
    productId,
    className,
    label = "Add to Cart",
    intent = "cart",
    children,
}: {
    productId: string;
    className?: string;
    label?: string;
    intent?: QuickBuyIntent;
    children?: React.ReactNode;
}) {
    const [open, setOpen] = React.useState(false);

    return (
        <>
            <CommerceFlowButton
                action={intent === "buy" ? "buy" : "cart"}
                variant={intent === "cart" ? "filled" : "outline"}
                className={className}
                onClick={(event) => {
                    // The card is wrapped in a link to the product page; opening the
                    // picker must not also navigate.
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(true);
                }}
            >
                {children ?? label}
            </CommerceFlowButton>

            <QuickBuyDialog
                productId={open ? productId : null}
                intent={intent}
                open={open}
                onClose={() => setOpen(false)}
            />
        </>
    );
}
