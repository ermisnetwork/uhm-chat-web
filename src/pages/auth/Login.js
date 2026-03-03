import { Stack } from '@mui/material';
import NewLogin from '@/pages/auth/NewLogin';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from '@/config';
import SEOHead from '@/components/SEOHead';
import { useTranslation } from 'react-i18next';

// ----------------------------------------------------------------------

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <>
      <SEOHead title={t('seo.login_title')} description={t('seo.login_description')} path="/login" />
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <NewLogin />
      </GoogleOAuthProvider>
    </>
  );
}
