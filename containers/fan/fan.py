#!/usr/bin/env python3
import requests
import pymodbus
import argparse
from pymodbus.server import StartTcpServer
from pymodbus.datastore import ModbusServerContext, ModbusDeviceContext, ModbusSequentialDataBlock
from pymodbus.pdu.device import ModbusDeviceIdentification
import logging
import random
import time
import threading

import os

# Argument parsing
parser = argparse.ArgumentParser(description="modbusTCP")
parser.add_argument("-a", "--address", required=False, default="0.0.0.0", help="ModbusTCP Address")
parser.add_argument("-p", "--port", required=False, default=502, type=int, help="ModbusTCP port")
parser.add_argument("-c", "--capacity", required=False, default=float(os.environ.get("CAPACITY", 2.0)), type=float, help="Fan capacity")
parser.add_argument("-e", "--endpoint", required=False, default=os.environ.get("ENDPOINT", "http://localhost:8000/"), help="Endpoint API REST")
parser.add_argument("-ft", "--fetch-time", required=False, default=1.0, type=float, help="Fetch time in seconds")
parser.add_argument("-acc", "--acceleration", required=False, default=float(os.environ.get("ACCELERATION", 100.0)), type=float, help="RPM acceleration (RPM/s)")
args = parser.parse_args()

# Enable logging
logging.basicConfig()
log = logging.getLogger()
log.setLevel(logging.INFO)

DISCRETE_INPUTS=16
COILS=16
HOLDING_REGS=16
INPUT_REGS=16

store = ModbusDeviceContext(
	di=ModbusSequentialDataBlock(0, [0]*DISCRETE_INPUTS),  # Discrete Inputs
	co=ModbusSequentialDataBlock(0, [0]*COILS),  # Coils
	hr=ModbusSequentialDataBlock(0, [0]*HOLDING_REGS),  # Holding Registers
	ir=ModbusSequentialDataBlock(0, [0]*INPUT_REGS)   # Input Registers
)
context = ModbusServerContext(devices=store, single=True)

def update_values(context):
    current_rpm = 0.0
    while True:
        # Read Power (HR 0)
        hr0 = context[0].getValues(3, 0, count=1)
        if isinstance(hr0, list):
            power = hr0[0]
            if power == 0: power = 1
        else:
            power = 1 # Default
        log.info(f"Read power (HR 0): {power}")

        # Read Target RPM (HR 1)
        hr1 = context[0].getValues(3, 1, count=1)
        if isinstance(hr1, list):
            target_rpm = hr1[0]
        else:
            log.error(f"Error reading Target RPM from HR 1: {hr1}")
            target_rpm = 0.0 # Default if error
        log.info(f"Target RPM (HR 1): {target_rpm}")

        # Simulate RPM transition
        if current_rpm < target_rpm:
            current_rpm = min(target_rpm, current_rpm + args.acceleration * args.fetch_time)
        elif current_rpm > target_rpm:
            current_rpm = max(target_rpm, current_rpm - args.acceleration * args.fetch_time)
        
        # Update Current RPM (IR 1)
        context[0].setValues(4, 1, [int(current_rpm)])
        log.info(f"Current RPM: {int(current_rpm)}")

        try:
            response = requests.get(args.endpoint + "engine")
            if response.status_code == 200:
                data = response.json()
                temperature = data.get("temperature")
                
                if temperature is not None:
                    # Update Temperature (IR 0)
                    context[0].setValues(4, 0, [int(temperature)])
                    log.info(f"Read temperature: {temperature}")
                    
                    # Calculate cooling based on power and current RPM
                    # If RPM is 0, cooling is 0. If RPM is 1000, cooling is full power.
                    # We can use (current_rpm / 1000.0) as a factor if we want, 
                    # but let's stick to the simplest interpretation first.
                    # I'll use current_rpm as the primary cooling factor if it's used.
                    # For now, I'll keep the existing 'power' logic but scaled by RPM/1000.
                    rpm_factor = current_rpm / 1000.0
                    new_temperature = temperature - (power * rpm_factor * args.capacity)
                    
                    post_url = args.endpoint + "engine/temperature"
                    payload = {"temperature": new_temperature}
                    post_response = requests.post(post_url, json=payload)
                    if post_response.status_code == 200:
                        log.info(f"Decreased temperature to {new_temperature}")
                    else:
                        log.error(f"Failed to decrease temperature. Status: {post_response.status_code}")
                else:
                    log.warning("No temperature in response")
            else:
                log.error(f"Error fetching endpoint: {response.status_code}")
        except Exception as e:
            log.error(f"Exception in update loop: {e}")
            
        time.sleep(args.fetch_time)

threading.Thread(target=update_values, args=(context,), daemon=True).start()
	

# Start the server
print(f"Server has started on port {args.port}")
identity = ModbusDeviceIdentification()
identity.VendorName = 'Pymodbus'
identity.ProductCode = 'PM'
identity.VendorUrl = 'http://github.com/riptideio/pymodbus/'
identity.ProductName = 'Pymodbus Server'
identity.ModelName = 'Pymodbus Server'
identity.MajorMinorRevision = '1.0'

StartTcpServer(context=context, identity=identity, address=(args.address, args.port))
