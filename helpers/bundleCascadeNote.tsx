// The sentence added to an unpublish toast when published bundles went down
// with the item. Empty when none did.
export const bundleCascadeNote = (bundleCount: number): string =>
  bundleCount === 0
    ? ""
    : bundleCount === 1
      ? " 1 published bundle was unpublished with it."
      : ` ${bundleCount} published bundles were unpublished with it.`;
