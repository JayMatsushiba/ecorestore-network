import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest runs here with globals: false, so testing-library cannot register
// its own afterEach cleanup; without this, one test's render stays mounted
// into the next and duplicate elements appear.
afterEach(() => {
  cleanup();
});

// Leaflet picks its vector renderer when it is first imported by probing
// SVGElement#createSVGRect, which jsdom does not implement. Without this shim
// it finds no renderer at all and adding any polygon throws, so the map
// component could not be exercised. Nothing is drawn; only the probe passes.
if (typeof SVGElement !== "undefined" && !("createSVGRect" in SVGElement.prototype)) {
  Object.defineProperty(SVGElement.prototype, "createSVGRect", { value: () => ({}), configurable: true });
}
