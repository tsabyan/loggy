// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("renders the placeholder home page", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { name: "Loggy" })).toBeDefined();
});
