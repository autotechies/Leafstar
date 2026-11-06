"use client";

import { useState } from "react";
import { Tabs, TabPanel } from "@/components/ui/Tabs";
import type { AddStockData } from "../queries";
import { AddToExisting } from "./AddToExisting";
import { ImportPanel } from "./ImportPanel";
import { NewArticleForm } from "./NewArticleFormLoader";

const tabs = [
  { id: "new", label: "New article" },
  { id: "existing", label: "Add to existing" },
  { id: "import", label: "Import from Excel" },
];

export function AddStockClient({ data }: { data: AddStockData }) {
  const [tab, setTab] = useState("new");
  return (
    <div className="flex flex-col gap-6">
      <Tabs items={tabs} value={tab} onChange={setTab} label="Add stock" />
      <TabPanel>
        {tab === "new" ? <NewArticleForm brands={data.brands} /> : null}
        {tab === "existing" ? <AddToExisting articles={data.articles} /> : null}
        {tab === "import" ? <ImportPanel /> : null}
      </TabPanel>
    </div>
  );
}
