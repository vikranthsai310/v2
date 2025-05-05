import '../styles/globals.css';
import '../hooks'; // Import hooks to ensure CONTRACT_ADDRESS is globally available
import type { AppProps } from 'next/app';
import { MantineProvider } from '@mantine/core';
import { Toaster } from 'react-hot-toast';
import { WagmiConfig, createConfig } from 'wagmi';
import { polygonMumbai } from 'wagmi/chains';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { publicProvider } from 'wagmi/providers/public';

// Configure wagmi
const config = createConfig({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({ chains: [polygonMumbai] }),
  ],
  publicClient: publicProvider(),
});

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <WagmiConfig config={config}>
      <MantineProvider
        withGlobalStyles
        withNormalizeCSS
        theme={{
          colorScheme: 'light',
          primaryColor: 'indigo',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <Component {...pageProps} />
        <Toaster position="top-right" />
      </MantineProvider>
    </WagmiConfig>
  );
}

export default MyApp; 