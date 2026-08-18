import { Screen, Card } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { H1, H2, P, Section } from '@/components/Prose'

/**
 * The named grievance officer (§11.1). Displayed prominently, with a name, an
 * email and a physical address.
 *
 * The address is public. Use a virtual office or a registered business
 * address, not your flat.
 *
 * TODO before Phase 1 ships to a real user: replace the placeholders. This
 * page existing with placeholders in it is the same as it not existing.
 */
export default function Grievance() {
  return (
    <Screen>
      <Section>
        <H1>Grievance officer</H1>
        <Card>
          <P>Name: [OFFICER NAME]</P>
          <P>Email: grievance@[DOMAIN]</P>
          <P>Address: [REGISTERED / VIRTUAL OFFICE ADDRESS]</P>
        </Card>

        <H2>What we do with a complaint</H2>
        <P>
          We acknowledge every complaint within 24 hours and dispose of it within 15 days. If a
          complaint concerns content about you, tell us the page and what is wrong with it.
        </P>

        <H2>If you are named in a report</H2>
        <P>
          You have a right of reply: one public reply of up to 300 characters, shown alongside
          the report. If a report is unlawful rather than merely unwelcome, tell us and we will
          act on it.
        </P>

        <H2>Takedown</H2>
        <P>
          We remove or disable unlawful content within 36 hours of a court order or government
          notification, and we log every moderation action.
        </P>
      </Section>

      <LegalFooter />
    </Screen>
  )
}
