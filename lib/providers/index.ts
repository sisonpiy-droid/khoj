import { BlinkitProvider } from "./blinkit";
import { ZeptoProvider } from "./zepto";
import { InstamartProvider } from "./instamart";
import { createMockProvider } from "./mock";
import type { Provider } from "@/types";

function shouldUseMock(): boolean {
  if (process.env.QUICKCOMMERCE_USE_MOCK === "false") return false;
  if (process.env.QUICKCOMMERCE_USE_MOCK === "true") return true;
  // Default: mock unless a real API key is actually configured.
  return !process.env.QUICKCOMMERCE_API_KEY;
}

export function getProviders(): Provider[] {
  if (shouldUseMock()) {
    return [
      createMockProvider("blinkit"),
      createMockProvider("zepto"),
      createMockProvider("instamart"),
    ];
  }
  return [new BlinkitProvider(), new ZeptoProvider(), new InstamartProvider()];
}

export { BlinkitProvider, ZeptoProvider, InstamartProvider };
