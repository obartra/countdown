import React from "react";
import { CountdownHeader } from "./components/ui/countdown-header";
import { HelperForm } from "./components/ui/helper-form";
import {
  CountdownProvider,
  useCountdownContext,
} from "./context/countdownContext";
import { useCountdownViewModel } from "./hooks/useCountdownViewModel";
import CountdownPreview from "./components/CountdownPreview";
import { CountdownParams } from "./countdown";

type AppProps = {
  initialParams?: CountdownParams;
};

const AppContent = () => {
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 text-center">
      <CountdownHeader title={params.title} textColor={params.textColor} />

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
        className="mx-auto w-full px-3 text-left"
        style={{ display: showHelper ? "none" : undefined }}
      >
        <CountdownPreview
          params={params}
          state={state}
          countdownDisplay={countdownDisplay}
          targetDate={targetDate}
          className="max-w-4xl text-left"
        />
      </main>
    </div>
  );
};

const App = ({ initialParams }: AppProps) => {
  const viewModel = useCountdownViewModel(initialParams);

  return (
    <CountdownProvider value={viewModel}>
      <AppContent />
    </CountdownProvider>
  );
};

export default App;
