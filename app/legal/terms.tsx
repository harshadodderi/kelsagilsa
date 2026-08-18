import { Screen } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { H1, H2, P, Section } from '@/components/Prose'

/**
 * Terms of service. Part of the §11 legal gate: no real user touches the
 * product until this, the privacy notice, the named grievance officer and the
 * takedown route all exist.
 *
 * Not legal advice — §11.2 (Consumer Protection E-Commerce Rules) needs an
 * opinion before Phase 6 takes a single rupee.
 */
export default function Terms() {
  return (
    <Screen>
      <Section>
        <H1>Terms of service</H1>

        <H2>What Kelsagilsa is</H2>
        <P>
          A place where people report what they paid for household jobs, so the next person
          knows what to expect. Every figure is what people reported paying. It is not a quote,
          and nobody is obliged to charge it.
        </P>

        <H2>What Kelsagilsa is not</H2>
        <P>
          We do not employ tradespeople, supervise work, handle payment, or guarantee an
          outcome. We do not vouch for anyone. Agreeing a price and a scope is between you and
          the person doing the work.
        </P>

        <H2>Who can use it</H2>
        <P>You must be 18 or over.</P>

        <H2>Reports</H2>
        <P>
          Report only jobs you actually paid for, and report the amount honestly. Reports can
          be edited for two hours, and are marked as edited afterwards. We do not publish paid
          or purchased reports, and we never accept payment to change a figure or a ranking.
        </P>

        <H2>Removal</H2>
        <P>
          We remove or disable unlawful content within 36 hours of a court order or government
          notification, and we keep the removed content and the associated records for 180
          days, as required. Anyone named in a report has a right of reply.
        </P>

        <H2>Complaints</H2>
        <P>See the Grievance page for the officer's name, address and email.</P>
      </Section>

      <LegalFooter />
    </Screen>
  )
}
