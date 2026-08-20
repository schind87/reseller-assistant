# Components

APIs below were read from source. If you need a prop that is not listed, the component does not have it — extend the source or use a local control, do not fake an API.

## BigButton

**File:** [src/components/BigButton.tsx](../../../../src/components/BigButton.tsx)

Primary page-level button. Client component.

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | `ReactNode` | required | |
| `variant` | `"primary" \| "secondary" \| "ghost" \| "danger"` | `"primary"` | |
| `fullWidth` | `boolean` | `true` | |
| `type` | button types | `"button"` | |
| `disabled` | boolean | | opacity 50 |
| plus native `ButtonHTMLAttributes` | | | |

Variants: primary = accent fill; secondary = white border; ghost = accent text; danger = `--danger` fill.

**Use:** Sign-in, create listing, save profile, Finish with AI, join retry.  
**Don't:** Every toolbar chip.

## CopyField

**File:** [src/components/CopyField.tsx](../../../../src/components/CopyField.tsx)

| Prop | Type | Default |
| --- | --- | --- |
| `label` | string | required |
| `value` | string | required |
| `multiline` | boolean | `false` |

Copy button toggles “Copy” / “Copied”. Empty value shows “—”.

## StepProgress

**File:** [src/components/StepProgress.tsx](../../../../src/components/StepProgress.tsx)

| Prop | Type | Default |
| --- | --- | --- |
| `current` | number | required |
| `total` | number | required |
| `label` | string | `Step {n} of {total}` |

Has `role="progressbar"`. Not currently the Phone Companion’s main chrome.

## QrPanel

**File:** [src/components/QrPanel.tsx](../../../../src/components/QrPanel.tsx)

| Prop | Type | Default |
| --- | --- | --- |
| `value` | string | required (URL) |
| `title` | string | `"Scan with your phone"` |
| `hint` | string | optional |
| `size` | number | 220, or 132 if `compact` |
| `code` | string \| null | optional join code |
| `compact` | boolean | `false` |

## ListingSchemaForm

**File:** [src/components/ListingSchemaForm.tsx](../../../../src/components/ListingSchemaForm.tsx)

Controlled marketplace fields. Requires `schema`, `title`, `description`, `price`, `fields`, change handlers, `onSubmit`, and `footer: ReactNode`. Optional AI rewrite props: `onRewriteDescription`, `rewritingDescription`, `descriptionAiWritten`.

Do not reimplement Mercari/Poshmark fields as a one-off form.

## ListingTweakDialog

**File:** [src/components/ListingTweakDialog.tsx](../../../../src/components/ListingTweakDialog.tsx)

Modal wrapper around `ListingSchemaForm`. Props include platform, schema, field values/handlers, `onSubmit`, `onClose`, optional rewrite/saving/draftDirty, `footerExtra`.

## PinSetupCard / ExtensionInstallCard / SellerOnboarding

Feature components, not generic primitives.

- `ExtensionInstallCard({ compact?: boolean })` — renders `null` if installed/checking.
- `SellerOnboarding` — `initial`, `editing`, `compact`, `onSaved`, `onCancel`.
- `PinSetupCard` — no props; fetches `/api/auth/pin`.

## AiGlyph

**File:** [src/components/AiPhotoBackgroundPicker.tsx](../../../../src/components/AiPhotoBackgroundPicker.tsx) (`export function AiGlyph`)

```tsx
<AiGlyph className="h-3.5 w-3.5 text-[var(--accent)]" />
```

`aria-hidden`. Use on AI actions only.
