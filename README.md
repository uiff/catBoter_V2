# Feeding Plan Wizard

## Overview
The Feeding Plan Wizard is a web application designed to manage feeding schedules for pets or livestock. It allows users to create, edit, and delete feeding plans, specifying feeding times, weights, and other parameters. The system also interfaces with various sensors and actuators for automation.

## Technologies Used
- **Frontend:**
  - React
  - TypeScript
  - Material-UI
  - Axios

- **Backend:**
  - Flask
  - Python
  - Psutil (for system information)
  - RPi.GPIO (for Raspberry Pi GPIO control)
  - APIs: Swagger for API documentation

- **Database:**
  - JSON file storage

## Sensors and Actuators
- **Distance Sensor:** VL53L0X
- **Weight Sensor:** Load cell with HX711
- **Motor Controller:** Servo motors for dispensing food

## Features
- **Feeding Plan Creation:** Easily create feeding plans with customizable times, weights, and sound options.
- **Feeding Time Management:** Users can add, edit, or delete feeding times for specific days.
- **Automatic Weight Distribution:** Option to automatically distribute total daily feed weight across all feeding times.
- **Day Selection:** Choose specific days or all days for feeding plans.
- **Real-time Sensor Monitoring:** Interface with hardware sensors to monitor system status.
- **Network Configuration:** Connect to WiFi and configure LAN settings directly from the app.
# catBoter_V2
