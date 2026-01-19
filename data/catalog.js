import drones from "../assets/config/drones.json";
import miners from "../assets/config/miners.json";
import planets from "../assets/config/planets.json";

export const CONFIG = { planets, drones, miners };

export const SPRITES = {
  backgrounds: {
    "bg_space_full.png": require("../assets/images/backgrounds/bg_space_full.png"),
  },
  planets: {
    "planet_01.png": require("../assets/images/sprites/planets/planet_01.png"),
  },
  drones: {
    "drone_01.png": require("../assets/images/sprites/drones/drone_01.png"),
  },
  miners: {
    "miner_01.png": require("../assets/images/sprites/miners/miner_01.png"),
  },
};
