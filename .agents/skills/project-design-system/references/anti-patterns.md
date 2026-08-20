# Anti-patterns

WRONG/CORRECT pairs from real source conventions.

## Invented tokens

```tsx
// WRONG — purple SaaS / arbitrary brand
<h1 className="bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent">

// CORRECT
<h1 className="font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
```

## Skipping BigButton for a page-level primary

```tsx
// WRONG
<button className="rounded-full bg-black px-3 py-1 text-xs">Create</button>

// CORRECT
<BigButton disabled={busy} onClick={() => createNewListing()}>
  {busy ? "Starting…" : "Create new listing"}
</BigButton>
```

## Card-wrapping a page header

```tsx
// WRONG
<div className="rounded-2xl border bg-white p-8 shadow-xl">
  <h1>Reseller Assistant</h1>
</div>

// CORRECT — typography first; card the listing row, not the title
<header>
  <h1 className="font-[family-name:var(--font-brand)] text-4xl">Reseller Assistant</h1>
  <p className="mt-2 text-lg text-[var(--muted)]">…</p>
</header>
```

## New dialog without dialog semantics

```tsx
// WRONG
<div className="fixed inset-0 bg-black/50">
  <div className="mx-auto mt-20 bg-white">…</div>
</div>

// CORRECT — follow ListingTweakDialog: role="dialog", aria-modal, labelled title, Escape, scroll lock
```

## Fake icon row

```tsx
// WRONG — lucide on every heading
<h2><Sparkles /> Photos</h2>

// CORRECT
<h2 className="font-[family-name:var(--font-brand)] text-2xl">Photos ({photos.length})</h2>
```

## Rebuilding listing fields

```tsx
// WRONG
<input placeholder="Title" />
<textarea placeholder="Description" />

// CORRECT
<ListingSchemaForm schema={schema} title={title} … footer={…} />
```
