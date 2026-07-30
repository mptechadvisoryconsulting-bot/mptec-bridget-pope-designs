"use client";

import Link from "next/link";

type TestDataFilterBarProps = {
  basePath: string;
  activeFilter?: string | null;
  testCount: number;
  totalCount: number;
};

export function TestDataFilterBar({ basePath, activeFilter, testCount, totalCount }: TestDataFilterBarProps) {
  const isTest = activeFilter === "test";
  const separator = basePath.includes("?") ? "&" : "?";

  return (
    <div className="topbar-actions" style={{ flexWrap: "wrap", gap: 8 }}>
      <Link className={!isTest ? "btn" : "btn btn-light"} href={basePath} prefetch={false}>
        All ({totalCount})
      </Link>
      <Link
        className={isTest ? "btn" : "btn btn-light"}
        href={`${basePath}${separator}filter=test`}
        prefetch={false}
        title="Emails starting with e2e. or names containing E2E / FullFlow / Audit"
      >
        Test / E2E ({testCount})
      </Link>
    </div>
  );
}
