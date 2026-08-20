# Imports

All UI primitives are path aliases from `@/components/...`. Named exports only (no default exports for these files).

```tsx
import { BigButton } from "@/components/BigButton";
import { CopyField } from "@/components/CopyField";
import { StepProgress } from "@/components/StepProgress";
import { QrPanel } from "@/components/QrPanel";
import { ListingSchemaForm } from "@/components/ListingSchemaForm";
import { ListingTweakDialog } from "@/components/ListingTweakDialog";
import { PinSetupCard } from "@/components/PinSetupCard";
import { ExtensionInstallCard } from "@/components/ExtensionInstallCard";
import { SellerOnboarding } from "@/components/SellerOnboarding";
import { AiGlyph } from "@/components/AiPhotoBackgroundPicker";
```

Screens (not primitives): `AppHome`, `ListingHub`, `PhotoCoach`, `CameraCapture`, `PhotoAspectCrop`, `AiPhotoBackgroundPicker`, `AiBgDebugConsole`.

Do not add a `src/components/ui/` barrel. Do not import from Geist or `@/components/ui/button`.
