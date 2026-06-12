/** Small formatting helpers shared across playground surfaces. */

export const numberFormatter = new Intl.NumberFormat("en-US");
export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const formatNumber = (n: number): string => numberFormatter.format(n);
export const formatCurrency = (n: number): string => currencyFormatter.format(n);

export const formatDate = (input: string | number | Date): string =>
  new Date(input).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const titleCase = (value: string): string => value.replace(/\b\w/g, (c) => c.toUpperCase());
