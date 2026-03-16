import type { Metadata } from "next";
import PortfolioClient from "./PortfolioClient";

export const metadata: Metadata = {
  title: "My Portfolio",
  description: "Track your Cardano DeFi portfolio — ADA balance, native tokens, staking rewards and yield opportunities.",
  alternates: { canonical: "https://dappsoncardano.com/portfolio" },
};

export default function PortfolioPage() {
  return <PortfolioClient />;
}
