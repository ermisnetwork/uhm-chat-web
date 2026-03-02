import { Stack } from '@mui/material';
import NewLogin from '@/pages/auth/NewLogin';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from '@/config';

// ----------------------------------------------------------------------

export default function LoginPage() {
  return (
    <>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <NewLogin />
      </GoogleOAuthProvider>
    </>
  );
}
