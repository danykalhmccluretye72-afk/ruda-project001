export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6 flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground text-pretty">{description}</p> : null}
    </header>
  )
}
