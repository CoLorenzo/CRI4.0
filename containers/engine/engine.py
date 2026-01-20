
import threading
import time
import argparse
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel

class TemperatureUpdate(BaseModel):
    temperature: float

class Engine:
    def __init__(self, temp_step, interval_seconds, start_temp=0.0):
        self.temperature = start_temp
        self.status = "stopped"
        self.temp_step = temp_step
        self.interval_seconds = interval_seconds
        self.running = False
        self._thread = None

    def start(self):
        if not self.running:
            self.running = True
            self.status = "running"
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()

    def _run_loop(self):
        while self.running:
            time.sleep(self.interval_seconds)
            self.temperature += self.temp_step

    def get_state(self):
        return {
            "temperature": self.temperature,
            "status": self.status
        }

    def set_temperature(self, temp):
        self.temperature = temp

# Global engine instance
engine = None

app = FastAPI()

@app.get("/engine")
def get_engine_status():
    global engine
    if engine:
        return engine.get_state()
    return {"error": "Engine not initialized"}

@app.post("/engine/temperature")
def set_engine_temperature(update: TemperatureUpdate):
    global engine
    if engine:
        engine.set_temperature(update.temperature)
        return engine.get_state()
    return {"error": "Engine not initialized"}

@app.get("/")
def root():
    return get_engine_status()

def main():
    global engine
    parser = argparse.ArgumentParser(description="Engine Simulator")
    parser.add_argument("-i", "--interface", type=str, required=False, default="0.0.0.0", help="Interface to bind to")
    parser.add_argument("-p", "--port", type=int, required=False, default=8000, help="Port to bind to") 
    parser.add_argument("-t", "--temperature-step", type=float, required=False, default=+1, help="Temperature increase step")
    parser.add_argument("-s", "--seconds", type=float, required=False, default=1, help="Time interval in seconds")
    parser.add_argument("-ts", "--temperature-start", type=float, required=False, default=30, help="Temperature start value")


    args = parser.parse_args()
    
    engine = Engine(args.temperature_step, args.seconds, args.temperature_start)
    engine.start()
    
    print(f"Starting Engine with step={args.temperature_step}, interval={args.seconds}, start_temp={args.temperature_start}")
    uvicorn.run(app, host=args.interface, port=args.port)

if __name__ == "__main__":
    main()
