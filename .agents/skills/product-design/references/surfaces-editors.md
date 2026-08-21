> Provenance: Surface-file shape follows Vercel’s published template.
> Content is from this repository. Not an official unpublished Vercel file.

# Surface: editors (listing fields, crop, AI backdrop)

## Load when

Editing title/description/price/structured fields, cropping a photo, or choosing an AI backdrop.

## Canonical owner

- Fields: [ListingSchemaForm.tsx](../../../../src/components/ListingSchemaForm.tsx) on the hub and in [ListingTweakDialog.tsx](../../../../src/components/ListingTweakDialog.tsx)
- Crop: [PhotoAspectCrop.tsx](../../../../src/components/PhotoAspectCrop.tsx)
- AI pick: [AiPhotoBackgroundPicker.tsx](../../../../src/components/AiPhotoBackgroundPicker.tsx)
- Draft generation: Write listing with AI on the hub

## Stable rules

### rule/hub-fields-are-canonical

- **Scope:** Listing copy and taxonomy
- **Rule:** The hub form is the source of truth. Tweak dialog is a larger editor for the posting moment, not a second data model.
- **Evidence:** Same `ListingSchemaForm` in both places; save then return to posting.
- **Exceptions:** None.
- **Bad:** Divergent fields only in the extension.
- **Good:** “Same fields you'll enter on {platform}.”

### rule/ai-is-assistive

- **Scope:** Write listing with AI, Write with AI, backdrop replace
- **Rule:** AI fills or proposes; the seller can change anything afterward. Buttons that invoke AI may use `AiGlyph`. Do not auto-publish.
- **Evidence:** Hub copy “You can change anything afterward.” Description “Write with AI” / “Rewrite”. Restore original in the AI picker.
- **Exceptions:** None.
- **Bad:** Replacing the form with an uneditable AI blob.
- **Good:** Editable fields under Write listing with AI.

### rule/platform-limits-are-visible

- **Scope:** Title and description
- **Rule:** Show `length/max` from the platform schema. Do not invent a global 280-character aesthetic.
- **Evidence:** `FIELD_LIMITS` and schema `maxLength` in the form labels.

## Good patterns

- Dirty vs saved: tweak footer “Save changes” / “Saved”.
- Crop dialog is about aspect for that marketplace (`PLATFORM_PHOTO_ASPECT`), not a generic Instagram crop.

## Bad patterns

- WYSIWYG rich text for marketplace descriptions (they are plain text).
- Hiding price as a “premium upsell” control.

## Coverage gaps

- Autosave vs explicit save is mixed (hub draft dirty vs tweak save). No written standard for when to persist on blur.
