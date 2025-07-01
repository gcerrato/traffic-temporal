export function validateEnvironmentVariables() {
  const requiredVars = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  };

  const missing = Object.entries(requiredVars)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(", ")}`);
    console.warn("The app will use fallback data for missing APIs");
    return false;
  }

  console.log("✅ All required environment variables are set");
  return true;
}

export function getApiKeys() {
  return {
    openai: process.env.OPENAI_API_KEY,
    googleMaps: process.env.GOOGLE_MAPS_API_KEY,
    sendGrid: process.env.SENDGRID_API_KEY,
  };
}
