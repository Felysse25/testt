# Analytics and feedback setup

The exhibition can measure progress toward 100 unique visitors and 20 completed feedback responses after publication. The GA4 ID and Google Forms link ship as placeholders in `exhibition/content.js`.

## 1. Create the GA4 web stream

1. Sign in to [Google Analytics](https://analytics.google.com/). In **Admin**, create or select an account, then choose **Create → Property**. Use the exhibition's reporting time zone and complete the property setup.
2. In **Admin → Data streams**, add a **Web** stream. Enter the final GitHub Pages website URL and a stream name. Disable **Enhanced measurement** for this stream so the exhibition controls what it sends and the tag avoids collecting automatic outbound links, form events, or other interactions.
3. Copy the stream's **Measurement ID**. In `exhibition/content.js`, replace `G-XXXXXXXXXX` in `analytics.measurementId`. Leave the exact placeholder for local copies where analytics should stay disabled.
4. Keep Google Signals, ads personalization, and advertising integrations off for this exhibition. Review the public privacy notice, consent wording, data retention, and any institution-specific requirements before launch. The exhibition uses opt-in consent. Only after a visitor allows analytics does it load the Google tag and send events. **Analytics settings** lets visitors change the choice. Withdrawal stops future exhibition analytics and does not erase previously collected data or automatically delete existing cookies. No rejected or pre-consent interactions are replayed. Analytics consent is independent of access to the questionnaire.

## 2. Configure the feedback form

1. Open the exhibition questionnaire in Google Forms. Publish it or enable responder access, then copy its **responder link**. Use an HTTPS `forms.gle` short link or a `docs.google.com/forms/.../viewform` link.
2. Replace `stations.feedback.formUrl` in `exhibition/content.js`. The **Give Feedback** button in **Share Your Experience** opens the form in a new tab. The booth and its panel also work with analytics declined.
3. Test access in a signed-out browser if the questionnaire is intended for the public. Prefer an anonymous form and avoid collecting names or emails unless your study calls for them and informs respondents.

## 3. Publish and verify

Publish the full project folder to GitHub Pages with `index.html`, `app/`, and `exhibition/` at the publishing root. Use the published HTTPS URL for verification.

1. Open the published URL with `?ga_debug=1`. If it already has a query string, use `&ga_debug=1`.
2. Before accepting, check the browser Network panel for requests to Google Analytics or Tag Manager. There should be none. Click **Allow analytics**. Check **Admin → DebugView** for the test device and events. DebugView requires a valid configured stream and a browser that permits the Google tag and collection requests.
3. Visit a country island, open a dish, play a configured interview, open **Share Your Experience**, then follow **Give Feedback**. Inspect event parameters. Move the camera and reset it to confirm those actions do not send extra events.
4. Use **Analytics settings → Decline** to verify withdrawal. Remove `ga_debug=1` for ordinary visits and keep DebugView traffic out of SMART reporting through an appropriate developer traffic filter or a separate test property.

| Event | When it is sent | Exhibit parameters |
| --- | --- | --- |
| `page_view` | Once per page load with consent | None |
| `exhibition_started` | Once per page load with consent | `island_id` |
| `island_visited` | Initial displayed island, then whenever selection changes | `island_id` |
| `country_opened` | First dish opened for that country per page load with consent | `island_id`, `country_id` |
| `food_opened` | When a dish panel opens | `island_id`, `country_id`, `food_id` |
| `interview_played` | First actual playback of each interview per page load with consent | `island_id`, `interview_id` |
| `feedback_opened` | When the feedback panel opens | `island_id` |
| `feedback_link_clicked` | When the configured form link is activated | `island_id` |
| `passport_stamp_collected` | When a new country stamp is collected | `island_id`, `country_id` |
| `passport_completed` | When the sixth stamp is collected | None |
| `quiz_started` | When a visitor starts or retries the quiz | None |
| `quiz_completed` | When a visitor reaches the score screen | None |
| `reflection_saved` | When a new or edited reflection is saved in the browser | None |

Quiz answers, scores, and reflection text stay out of analytics. Passport
stamps and the reflection use browser storage independently of analytics consent.

If you want to analyze those parameters in GA4 reports, register the four keys as **event-scoped custom dimensions** under **Admin → Custom definitions** before collecting data. The code sends exhibit IDs and the page URL with only the recognized QR campaign query. It suppresses the referrer field and does not send form links, responses, names, or email addresses.

## 4. Measure the SMART targets

- **100 unique exhibition visitors.** In GA4, open **Explore → Free form** and select **Total users** for your published exhibition and evaluation dates. Filter by the GitHub Pages hostname and exhibition landing path or by `exhibition_started`, especially if the property measures other pages. Use the aggregate total across the period, not a sum of daily or event rows. GA4 Total users is an estimate for consenting, measurable browsers or devices. Declined consent and blocking reduce coverage, and multiple devices can represent one person.
- **20 completed feedback responses.** In Google Forms, open **Responses → Summary** and count completed submissions. Use the linked spreadsheet timestamps if you need to restrict the reporting period. Exclude test responses from the evaluation. GA4 feedback-panel opens and link clicks measure interest only.

## 5. Create the QR campaign link

Start with your final GitHub Pages URL and append these campaign parameters:

```
https://YOUR-ACCOUNT.github.io/YOUR-REPOSITORY/?utm_source=qr&utm_medium=offline&utm_campaign=more_than_a_meal
```

Use `&` instead of `?` if the URL already has a query string. Paste the full URL into your preferred QR code generator, download the code, and scan it on a phone before printing. Confirm it lands on your published exhibition with all three parameters intact. In GA4 **Traffic acquisition**, look for session source / medium **qr / offline** and session campaign **more_than_a_meal**.
