export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-white px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
