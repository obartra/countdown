import React, { useState } from "react";
import { CountdownHeader } from "./components/ui/countdown-header";
import { HelperForm } from "./components/ui/helper-form";
import {
  CountdownProvider,
  useCountdownContext,
} from "./context/countdownContext";
import { useCountdownViewModel } from "./hooks/useCountdownViewModel";
import CountdownPreview from "./components/CountdownPreview";
import { ReportModal } from "./components/ReportModal";
import { CountdownParams } from "./countdown";

type AppProps = {
  initialParams?: CountdownParams;
  publishedSlug?: string;
};

const AppContent = ({ publishedSlug }: { publishedSlug?: string }) => {
  const {
    params,
    state,
    helperValue,
    setHelperValue,
    helperError,
    setHelperError,
    countdownDisplay,
    targetDate,
    handleHelperSubmit,
    onPrefill,
  } = useCountdownContext();

  const showHelper = state === "helper";
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const handleOpenReport = () => setReportModalOpen(true);
  const handleCloseReport = () => setReportModalOpen(false);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 text-center">
      <CountdownHeader
        title={params.title}
        textColor={params.textColor}
        publishedSlug={publishedSlug}
      />

      <HelperForm
        show={showHelper}
        helperValue={helperValue}
        setHelperValue={setHelperValue}
        helperError={helperError}
        setHelperError={setHelperError}
        onPrefill={onPrefill}
        onSubmit={handleHelperSubmit}
      />

      <main
        role="main"
        className="mx-auto flex w-full flex-1 flex-col px-3 text-left"
        style={{ display: showHelper ? "none" : undefined }}
      >
        <CountdownPreview
          params={params}
          state={state}
          countdownDisplay={countdownDisplay}
          targetDate={targetDate}
          className="max-w-4xl text-left"
          reportAction={
            publishedSlug ? { onClick: handleOpenReport } : undefined
          }
        />
      </main>
      {publishedSlug ? (
        <ReportModal
          slug={publishedSlug}
          open={isReportModalOpen}
          onClose={handleCloseReport}
        />
      ) : null}
    </div>
  );
};

const App = ({ initialParams, publishedSlug }: AppProps) => {
  const viewModel = useCountdownViewModel(initialParams);

  return (
    <CountdownProvider value={viewModel}>
      <AppContent publishedSlug={publishedSlug} />
    </CountdownProvider>
  );
};

export default App;
