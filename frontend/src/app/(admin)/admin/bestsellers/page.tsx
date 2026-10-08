"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminBestseller,
  AdminProduct,
  createAdminBestseller,
  deleteAdminBestseller,
  getAdminBestsellers,
  getAllProducts,
  updateAdminBestseller,
} from "@/services/admin";
import { toast } from "sonner";

export default function AdminBestsellersPage() {
  const [loading, setLoading] = React.useState(true);
  const [bestsellers, setBestsellers] = React.useState<AdminBestseller[]>([]);
  const [products, setProducts] = React.useState<AdminProduct[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [positionEdits, setPositionEdits] = React.useState<Record<string, string>>({});
  const [workingId, setWorkingId] = React.useState<string | null>(null);

  const maxReached = bestsellers.length >= 4;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [bestsellerRes, productRes] = await Promise.all([
        getAdminBestsellers(),
        getAllProducts(),
      ]);
      setBestsellers(bestsellerRes.bestsellers ?? []);
      setProducts(productRes.products ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load bestsellers"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const availableProducts = React.useMemo(() => {
    const existing = new Set(bestsellers.map((item) => item.productId));
    const query = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      if (existing.has(product.id)) return false;
      if (product.deletedByAdmin) return false;
      if (!product.isPublished) return false;

      if (!query) return true;

      const haystack = [
        product.title,
        product.categoryName,
        product.sellerEmail,
        product.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [bestsellers, products, searchQuery]);

  const handleAdd = async (productId: string) => {
    if (maxReached) {
      toast.error("You can only select 4 bestsellers.");
      return;
    }
    try {
      setWorkingId(productId);
      await createAdminBestseller(productId);
      toast.success("Added to bestsellers");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to add bestseller"
      );
    } finally {
      setWorkingId(null);
    }
  };

  const handleUpdate = async (item: AdminBestseller) => {
    const value = positionEdits[item.id] ?? String(item.position);
    const nextPosition = Number(value);

    if (!Number.isFinite(nextPosition) || nextPosition <= 0) {
      toast.error("Position must be a positive number");
      return;
    }

    try {
      setWorkingId(item.id);
      await updateAdminBestseller(item.id, nextPosition);
      toast.success("Bestseller position updated");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update position"
      );
    } finally {
      setWorkingId(null);
    }
  };

  const handleRemove = async (item: AdminBestseller) => {
    try {
      setWorkingId(item.id);
      await deleteAdminBestseller(item.id);
      toast.success("Removed from bestsellers");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove bestseller"
      );
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 lg:py-20"
      >
        {/* Header */}
        <div className="space-y-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-brand-strong">
            Merchandising Control
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Bestseller Management
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Curate which products appear on the homepage. Add published listings and fine-tune their display order.
          </p>
        </div>

        {/* Add Bestsellers */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="border border-border-soft bg-card"
        >
          <div className="border-b border-border-soft p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  Add Products
                </p>
                <p className="font-serif text-lg font-light text-foreground">
                  Available Listings
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Select up to 4 products to feature on the homepage.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products to add..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-10 w-full sm:w-72 border-0 bg-transparent focus-visible:ring-0"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading products...</p>
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No available products found.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-soft">
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Title
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Seller
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Category
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {availableProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-mist/30 dark:hover:bg-navy/10 transition-colors duration-200"
                    >
                      <td className="p-6 font-medium text-foreground">
                        {product.title}
                      </td>
                      <td className="p-6 text-muted-foreground">
                        {product.sellerEmail ?? product.sellerId?.slice(0, 8)}
                      </td>
                      <td className="p-6 text-muted-foreground">
                        {product.categoryName ?? product.categoryId?.slice(0, 6)}
                      </td>
                      <td className="p-6">
                        <Button
                          size="sm"
                          onClick={() => handleAdd(product.id)}
                          disabled={workingId === product.id || maxReached}
                        >
                          {workingId === product.id ? "Adding..." : maxReached ? "Limit reached" : "Add"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.section>

        {/* Bestseller List */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="border border-border-soft bg-card"
        >
          <div className="border-b border-border-soft p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  Homepage Ordering
                </p>
                <p className="font-serif text-lg font-light text-foreground">
                  Current Bestsellers
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {bestsellers.length} items
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading bestsellers...</p>
              </div>
            ) : bestsellers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No bestsellers selected yet.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border-soft">
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Title
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Position
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Seller
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Status
                    </th>
                    <th className="p-6 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {bestsellers.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-mist/30 dark:hover:bg-navy/10 transition-colors duration-200"
                    >
                      <td className="p-6 font-medium text-foreground">
                        {item.title}
                      </td>
                      <td className="p-6">
                        <Input
                          type="number"
                          min={1}
                          value={positionEdits[item.id] ?? String(item.position)}
                          onChange={(event) =>
                            setPositionEdits((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="h-9 w-24 border-border-soft"
                        />
                      </td>
                      <td className="p-6 text-muted-foreground">
                        {item.sellerEmail ?? item.productId.slice(0, 8)}
                      </td>
                      <td className="p-6 text-muted-foreground">
                        {item.deletedByAdmin
                          ? "Removed"
                          : item.isPublished
                          ? "Published"
                          : "Draft"}
                      </td>
                      <td className="p-6 flex flex-col gap-2 sm:flex-row">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdate(item)}
                          disabled={workingId === item.id}
                        >
                          {workingId === item.id ? "Saving..." : "Update"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => handleRemove(item)}
                          disabled={workingId === item.id}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
