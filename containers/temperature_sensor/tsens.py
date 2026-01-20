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

# Argument parsing
parser = argparse.ArgumentParser(description="modbusTCP")
parser.add_argument("-a", "--address", required=False, default="0.0.0.0", help="ModbusTCP Address")
parser.add_argument("-p", "--port", required=False, default=1502, type=int, help="ModbusTCP port")
parser.add_argument("-ft", "--fetch-time", required=False, default=1.0, type=float, help="Fetch time seconds")
parser.add_argument("-e", "--endpoint", required=False, default="http://localhost:8000/", help="Endpoint API REST")
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
	while True:
		try:
			response = requests.get(args.endpoint)
			if response.status_code == 200:
				data = response.json()
				temperature = data.get("temperature")
				if temperature is not None:
					# Update Input Register (Function Code 4) address 0 with temperature
					# We cast to int because Modbus registers are essentially integers
					context[0].setValues(4, 0, [int(temperature)])
					log.info(f"Updated temperature to {int(temperature)}")
				else:
					log.warning("No temperature in response")
			else:
				log.error(f"Error fetching endpoint: {response.status_code}")
		except Exception as e:
			log.error(f"Exception in fetching: {e}")
		
		time.sleep(args.fetch_time)

threading.Thread(target=update_values, args=(context,), daemon=True).start()
	
# Start the server
print(f"Server has started on port {args.port}")
StartTcpServer(context=context, address=(args.address, args.port))
