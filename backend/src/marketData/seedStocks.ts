import type { Scenario } from "./scenarios";

export interface StockSeed {
  symbol: string;
  name: string;
  previousClose: number;
  weekHigh52: number;
  weekLow52: number;
  avgVolume: number;
  scenario: Scenario;
}

// Baseline data for a small set of recognizable Indian large-caps.
// Change a stock's `scenario` here to demo a different kind of market move.
export const STOCK_SEEDS: StockSeed[] = [
  {
    symbol: "TCS",
    name: "Tata Consultancy Services",
    previousClose: 3850,
    weekHigh52: 4260,
    weekLow52: 3550,
    avgVolume: 2_500_000,
    scenario: "normal",
  },
  {
    symbol: "INFY",
    name: "Infosys",
    previousClose: 1550,
    weekHigh52: 1770,
    weekLow52: 1350,
    avgVolume: 6_000_000,
    scenario: "normal",
  },
  {
    symbol: "RELIANCE",
    name: "Reliance Industries",
    previousClose: 2950,
    weekHigh52: 3220,
    weekLow52: 2550,
    avgVolume: 5_500_000,
    scenario: "normal",
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank",
    previousClose: 1650,
    weekHigh52: 1790,
    weekLow52: 1400,
    avgVolume: 8_000_000,
    scenario: "normal",
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank",
    previousClose: 1180,
    weekHigh52: 1310,
    weekLow52: 950,
    avgVolume: 7_200_000,
    scenario: "normal",
  },
];
