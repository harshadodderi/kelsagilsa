import { Screen, Card } from '@/components/Screen'
import { LegalFooter } from '@/components/LegalFooter'
import { H1, H2, P, Section } from '@/components/Prose'

/**
 * The privacy notice.
 *
 * The erasure paragraph below is settled BEFORE the first report is collected
 * (§10.2). Retrofitting it after your first deletion request is impossible,
 * because by then you have promised something else. Do not soften it, and do
 * not add a "we may" to it.
 *
 * Not legal advice. §11.2 and §11.3 need a professional opinion.
 */
export default function Privacy() {
  return (
    <Screen>
      <Section>
        <H1>Privacy notice</H1>
        <P>
          Kelsagilsa collects what people paid for household jobs, and publishes it as a price
          range for an area and a job type. This notice says what we hold, why, and for how
          long.
        </P>

        <H2>What we hold</H2>
        <P>
          Your email address, so you can sign in. Your first name, if you give one. A rough
          location — accurate to about a kilometre, never an address, unless you send a booking
          request. The amounts you report, the job type, and the month.
        </P>

        <H2>What is published</H2>
        <P>
          Amounts, as ranges and counts, for an area and a job type. Your first name appears
          only on reports where you asked for it. Your surname, phone number, email address and
          exact location are never published, never shown to a tradesperson, and never
          exported.
        </P>

        <H2>Deleting your account</H2>
        <Card>
          <P>
            On account deletion, the reporter link is severed and the report survives as an
            anonymous data point in the price aggregate. Free-text comments and photos are
            deleted.
          </P>
        </Card>
        <P>
          We say this plainly because the alternative — deleting the numbers — would let one
          person quietly change what everyone else sees the market rate to be.
        </P>

        <H2>How long we keep things</H2>
        <P>
          Booking addresses: 30 days after the job ends. Sign-in logs: 90 days. Comments and
          photos: until you delete your account. Content we remove after a complaint, and the
          registration records that go with it: 180 days, as the IT Rules require. Moderation
          records: 3 years.
        </P>

        <H2>Age</H2>
        <P>Kelsagilsa is for people over 18. We ask for a birth year, never a full date.</P>

        <H2>Complaints</H2>
        <P>
          Our grievance officer is named on the Grievance page, with an address and an email.
          Complaints are acknowledged within 24 hours and disposed of within 15 days.
        </P>
      </Section>

      <LegalFooter />
    </Screen>
  )
}
