import type { ComponentProps, ReactNode } from "react";

const TALLY_FORM_ID = "D4DGyq";

type WaitlistTriggerProps = Omit<ComponentProps<"a">, "href"> & {
  children: ReactNode;
};

export function WaitlistTrigger({ children, ...props }: WaitlistTriggerProps) {
  return (
    <a
      href="/waitlistsignup"
      data-tally-open={TALLY_FORM_ID}
      data-tally-layout="modal"
      {...props}
    >
      {children}
    </a>
  );
}