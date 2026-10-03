import MapView from "../map/MapView";
import { useConditions } from "../features/conditions/useConditions";

export default function Home() {
  const { data, error } = useConditions();

  const handleRunNow = () => {
    alert("Route suggestions need the backend. Coming in the next phase.");
  };

  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0">
        <MapView />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-2xl shadow-lg p-4">
        <div className="flex justify-between text-sm text-gray-700 mb-3">
          {error && <span>Conditions unavailable</span>}
          {!error && !data && <span>Loading conditions...</span>}
          {data && (
            <>
              <span>{data.temp}°C</span>
              <span>
                Air: {data.aqiLabel} ({data.aqi})
              </span>
              <span>Sunset {data.sunset}</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleRunNow}
          className="w-full bg-green-600 text-white rounded-xl py-4 text-lg font-bold"
        >
          RUN NOW
        </button>

        <p className="text-xs text-gray-500 text-center mt-2">
          Safest loop and safe window will appear here.
        </p>
      </div>
    </div>
  );
}