import { Checkbox } from './Checkbox';

export const BasicCheckbox = {
  size: "sm",
  backdrop: "surface",
  title: "Basic Checkbox",
  component: () => (
    <>
      <Checkbox id="basic" />
      <label htmlFor="basic">Basic checkbox</label>
    </>
  )
};

export const CheckedCheckbox = {
  size: "sm",
  backdrop: "surface",
  title: "Checked Checkbox",
  component: () => (
    <>
      <Checkbox id="checked" defaultChecked />
      <label htmlFor="checked">Checked by default</label>
    </>
  )
};

export const DisabledStates = {
  size: "sm",
  backdrop: "surface",
  title: "Disabled States",
  component: () => (
    <>
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
        <Checkbox id="disabled" disabled />
        <label htmlFor="disabled">Disabled</label>
      </div>
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
        <Checkbox id="disabledChecked" disabled defaultChecked />
        <label htmlFor="disabledChecked">Disabled checked</label>
      </div>
    </>
  )
};
