import Script from "next/script";

const defaultMeasurementId = "G-8D8Z3EH55D";
const measurementIdPattern = /^G-[A-Z0-9]+$/i;

function getMeasurementId() {
  const configuredId = process.env.GOOGLE_ANALYTICS_ID?.trim();
  const measurementId = configuredId || defaultMeasurementId;

  return measurementIdPattern.test(measurementId) ? measurementId : null;
}

export function GoogleAnalytics() {
  const measurementId = getMeasurementId();

  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
