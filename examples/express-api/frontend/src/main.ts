import { createPrometheusClient } from '@prometheus-protocol/typescript-sdk/browser';

// --- UI Elements ---
const loggedOutView = document.getElementById('loggedOutView')!;
const loggedInView = document.getElementById('loggedInView')!;
const loginButton = document.getElementById('loginButton')!;
const logoutButton = document.getElementById('logoutButton')!;
const callApiButton = document.getElementById('callApiButton')!;
const principalDisplay = document.getElementById('principalDisplay')!;
const tokenDisplay = document.getElementById('tokenDisplay')!;
const apiResponse = document.getElementById('apiResponse')!;

let prometheusClient: Awaited<
  ReturnType<typeof createPrometheusClient>
> | null = null;

// --- Main App Logic ---
async function handleAuthentication() {
  try {
    // This one function does everything.
    prometheusClient = await createPrometheusClient({
      authCanisterId: import.meta.env.VITE_AUTH_CANISTER_ID,
      resourceServerUrl: import.meta.env.VITE_RESOURCE_SERVER_URL,
      icHost: import.meta.env.VITE_IC_HOST,
      clientMetadata: {
        client_name: 'Prometheus Demo SPA (Dynamic)',
        grant_types: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_method: 'none',
        scope:
          'openid prometheus:charge profile:read image:read image:write image:delete billing:read',
      },
    });

    // If the promise resolves, we are logged in.
    updateUi();
  } catch (error) {
    console.error('Authentication flow failed or was redirected:', error);
  }
}

function updateUi() {
  if (prometheusClient) {
    loggedOutView.style.display = 'none';
    loggedInView.style.display = 'block';
    principalDisplay.textContent = prometheusClient.getPrincipal();
    tokenDisplay.textContent = JSON.stringify(prometheusClient.tokens, null, 2);
  } else {
    loggedOutView.style.display = 'block';
    loggedInView.style.display = 'none';
  }
}

// --- Event Handlers ---
loginButton.onclick = () => {
  // The login button simply re-runs the main auth function.
  // It will see no tokens and no auth code, and will correctly
  // initiate the redirect to the login page.
  handleAuthentication();
};

logoutButton.onclick = () => {
  // A real logout would involve token revocation.
  // For now, we just clear local state.
  localStorage.clear();
  prometheusClient = null;
  updateUi();
};

callApiButton.onclick = async () => {
  const accessToken = prometheusClient?.getAccessToken();
  if (!accessToken) {
    alert('You are not logged in!');
    return;
  }
  apiResponse.textContent = 'Calling API...';
  try {
    const response = await fetch(
      'http://localhost:8079/api/super-secret-data',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const data = await response.json();
    apiResponse.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    if (error instanceof Error) {
      console.error('API call failed:', error);
      apiResponse.textContent = `Error: ${error.message}`;
    } else {
      console.error('API call failed:', error);
      apiResponse.textContent = 'An unknown error occurred.';
    }
  }
};
