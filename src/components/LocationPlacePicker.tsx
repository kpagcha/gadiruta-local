import { Check, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocationMunicipality, LocationOption } from '../data/location-search.ts';
import { Icon } from './Icon';

/** Render the two animated place-selection steps beside a location input. */
export function LocationPlacePicker({
  id,
  label,
  municipalities,
  isOpen,
  step,
  pendingChoice,
  onSelectMunicipality,
  onSelectArea,
  onBack,
}: {
  id: string;
  label: string;
  municipalities: readonly LocationMunicipality[];
  isOpen: boolean;
  step: 'municipalities' | 'areas';
  pendingChoice: LocationOption | null;
  onSelectMunicipality: (municipality: LocationMunicipality) => void;
  onSelectArea: (choice: LocationOption) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  /** Focus the active choice after opening or changing picker steps. */
  useEffect(() => {
    if (isOpen) firstChoiceRef.current?.focus();
  }, [isOpen, step]);
  const selectedMunicipality = municipalities.find(
    (municipality) =>
      pendingChoice?.kind === 'place' &&
      (pendingChoice.municipalityId === municipality.id || pendingChoice.parentMunicipalityId === municipality.id),
  );
  const selectedAreaId = pendingChoice?.kind === 'place' ? (pendingChoice.localAreaId ?? 'all') : 'all';
  const selectedAreaName =
    selectedAreaId === 'all'
      ? t('search.allAreas')
      : (selectedMunicipality?.areas.find((area) => area.id === selectedAreaId)?.name ?? t('search.allAreas'));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={id + '-place-picker'}
          aria-label={label + ': ' + t('search.chooseFromList')}
          className="absolute right-0 left-0 z-50 mt-2 w-full overflow-hidden rounded-2xl border border-line-popover bg-surface-card p-2 shadow-[var(--shadow-popover)]"
          initial={reducedMotion ? false : { opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.16 }}
          role="dialog"
        >
          <AnimatePresence mode="wait" initial={false}>
            {step === 'municipalities' ? (
              <motion.div
                key="municipalities"
                className="max-h-[min(22rem,65dvh)] space-y-1 overflow-y-auto"
                initial={reducedMotion ? false : { opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, x: -10 }}
                transition={{ duration: 0.1 }}
                onAnimationComplete={() => firstChoiceRef.current?.focus()}
              >
                {municipalities.map((municipality, index) => (
                  <button
                    key={municipality.id}
                    ref={
                      municipality.id === selectedMunicipality?.id || (!selectedMunicipality && index === 0)
                        ? firstChoiceRef
                        : undefined
                    }
                    className="motion-interactive flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-[650] text-ink hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                    onClick={() => onSelectMunicipality(municipality)}
                    type="button"
                  >
                    <span>{municipality.name}</span>
                    {municipality.areas.length > 1 && (
                      <Plus aria-hidden="true" className="shrink-0 text-muted" size={16} strokeWidth={1.8} />
                    )}
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="areas"
                initial={reducedMotion ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, x: 10 }}
                transition={{ duration: 0.1 }}
                onAnimationComplete={() => firstChoiceRef.current?.focus()}
              >
                <div className="flex min-w-0 items-center gap-2 border-b border-line px-1 pb-2">
                  <button
                    className="motion-interactive min-w-0 rounded-lg bg-surface-hover px-2.5 py-2 text-left text-sm font-[700] text-ink hover:bg-surface-active focus-visible:outline-2 focus-visible:outline-accent"
                    onClick={onBack}
                    type="button"
                  >
                    <span className="block truncate">{selectedMunicipality?.name}</span>
                  </button>
                  <Icon name="arrow" className="shrink-0 text-accent" size={17} />
                  <span className="min-w-0 truncate text-sm font-[700] text-accent">{selectedAreaName}</span>
                </div>
                <div className="max-h-[min(18rem,52dvh)] space-y-1 overflow-y-auto pt-1">
                  {selectedMunicipality &&
                    [
                      { id: 'all', name: t('search.allAreas'), choice: selectedMunicipality.choice },
                      ...selectedMunicipality.areas,
                    ].map((area) => (
                      <button
                        key={area.id}
                        ref={selectedAreaId === area.id ? firstChoiceRef : undefined}
                        aria-pressed={selectedAreaId === area.id}
                        className={
                          selectedAreaId === area.id
                            ? 'motion-interactive flex min-h-8 w-full items-center justify-between gap-3 rounded-xl bg-surface-selected px-3 py-2 text-left text-sm font-[700] text-accent focus-visible:outline-2 focus-visible:outline-accent'
                            : 'motion-interactive flex min-h-8 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-[650] text-ink hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none'
                        }
                        onClick={() => onSelectArea(area.choice)}
                        type="button"
                      >
                        <span>{area.name}</span>
                        {selectedAreaId === area.id && <Check aria-hidden="true" className="shrink-0" size={16} />}
                      </button>
                    ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
