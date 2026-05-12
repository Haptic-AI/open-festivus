import type { IEvaluationConfig, ISimEnvironment } from "@festivus/types"

const ENV_MUJOCO_TABLETOP: ISimEnvironment = {
  id: "env-mujoco-tabletop",
  name: "MuJoCo Tabletop",
  simulator: "mujoco",
  scene: "tabletop_manipulation",
  description: "Flat table with randomized object positions. Standard for pick-and-place evaluation.",
}

const ENV_MUJOCO_ALOHA: ISimEnvironment = {
  id: "env-mujoco-aloha",
  name: "MuJoCo ALOHA Sim",
  simulator: "mujoco",
  scene: "aloha_sim_transfer_cube",
  description: "ALOHA bimanual setup in MuJoCo. Two arms facing each other with shared workspace.",
}

const ENV_ISAAC_GYM_FLAT: ISimEnvironment = {
  id: "env-isaac-gym-flat",
  name: "Isaac Gym Flat Terrain",
  simulator: "isaac-gym",
  scene: "flat_terrain_4096_envs",
  description: "Flat ground with domain randomization. 4096 parallel environments for locomotion.",
}

const ENV_ISAAC_GYM_ROUGH: ISimEnvironment = {
  id: "env-isaac-gym-rough",
  name: "Isaac Gym Rough Terrain",
  simulator: "isaac-gym",
  scene: "rough_terrain_procedural",
  description: "Procedurally generated rough terrain with slopes, stairs, and gaps.",
}

const ENV_MUJOCO_PUSHT: ISimEnvironment = {
  id: "env-mujoco-pusht",
  name: "MuJoCo Push-T",
  simulator: "mujoco",
  scene: "pusht_planar",
  description: "Planar pushing task. Robot must push T-shaped block to target pose.",
}

const ENV_SIMPLER_KITCHEN: ISimEnvironment = {
  id: "env-simpler-kitchen",
  name: "SIMPLER Kitchen",
  simulator: "mujoco",
  scene: "simpler_env_google_robot",
  description: "Google Robot RT evaluation environments. Countertop manipulation scenes.",
}

export const EVALUATION_CONFIGS: Record<string, IEvaluationConfig> = {
  "act-aloha-sim-transfer-cube": {
    policySlug: "act-aloha-sim-transfer-cube",
    environments: [ENV_MUJOCO_ALOHA, ENV_MUJOCO_TABLETOP],
    robots: [
      {
        robotSlug: "aloha-2",
        robotName: "ALOHA 2",
        compatibility: {
          status: "compatible",
          actionSpaceMatch: true,
          controlFrequencyMatch: true,
        },
        environments: [
          {
            environmentId: "env-mujoco-aloha",
            result: {
              successRate: 98,
              episodes: 2000,
              videoUrl: "https://www.youtube.com/embed/HaaZ8ss-HP4",
              failureModes: ["Occasional drop during handover (2%)", "Cube slip on smooth surfaces"],
            },
          },
          {
            environmentId: "env-mujoco-tabletop",
            result: {
              successRate: 85,
              episodes: 500,
              failureModes: ["Adapted scene, not primary training env", "Reduced workspace causes collisions"],
              notes: "Non-standard environment. Results are from community testing.",
            },
          },
        ],
      },
      {
        robotSlug: "so-100",
        robotName: "SO-100",
        compatibility: {
          status: "partial",
          actionSpaceMatch: true,
          controlFrequencyMatch: false,
          reason: "ACT was trained at 50Hz but SO-100 servos max out at 30Hz. May work with interpolation.",
        },
        environments: [
          {
            environmentId: "env-mujoco-tabletop",
            result: {
              successRate: 72,
              episodes: 400,
              failureModes: ["Timing mismatch causes jerky motion", "Single arm can't do bimanual tasks"],
              notes: "Adapted to single-arm. Cube transfer becomes pick-and-place.",
            },
          },
          { environmentId: "env-mujoco-aloha" },
        ],
      },
      {
        robotSlug: "unitree-go2",
        robotName: "Unitree Go2",
        compatibility: {
          status: "incompatible",
          actionSpaceMatch: false,
          controlFrequencyMatch: false,
          reason: "Go2 uses joint_torque actions for locomotion. This policy outputs joint_position for manipulation.",
        },
        environments: [],
      },
    ],
  },

  "diffusion-policy-pusht": {
    policySlug: "diffusion-policy-pusht",
    environments: [ENV_MUJOCO_PUSHT, ENV_MUJOCO_TABLETOP, ENV_SIMPLER_KITCHEN],
    robots: [
      {
        robotSlug: "franka-panda",
        robotName: "Franka Panda",
        compatibility: {
          status: "compatible",
          actionSpaceMatch: true,
          controlFrequencyMatch: true,
        },
        environments: [
          {
            environmentId: "env-mujoco-pusht",
            result: {
              successRate: 97,
              episodes: 5000,
              videoUrl: "https://www.youtube.com/embed/XJKs3YQ_K0c",
              failureModes: ["Rare overshoot on final alignment (3%)"],
            },
          },
          {
            environmentId: "env-simpler-kitchen",
            result: {
              successRate: 62,
              episodes: 300,
              failureModes: ["Out-of-distribution objects", "Kitchen clutter causes occlusion"],
              notes: "Transfer to kitchen env without fine-tuning. Lower performance expected.",
            },
          },
        ],
      },
      {
        robotSlug: "so-100",
        robotName: "SO-100",
        compatibility: {
          status: "partial",
          actionSpaceMatch: true,
          controlFrequencyMatch: true,
          reason: "Action space matches but workspace is smaller. Push-T task may exceed reach.",
        },
        environments: [
          { environmentId: "env-mujoco-pusht" },
          { environmentId: "env-mujoco-tabletop" },
        ],
      },
      {
        robotSlug: "unitree-h1",
        robotName: "Unitree H1",
        compatibility: {
          status: "incompatible",
          actionSpaceMatch: false,
          controlFrequencyMatch: false,
          reason: "H1 is a humanoid. This policy requires a fixed-base arm with end-effector position control.",
        },
        environments: [],
      },
    ],
  },

  "walk-these-ways-go2": {
    policySlug: "walk-these-ways-go2",
    environments: [ENV_ISAAC_GYM_FLAT, ENV_ISAAC_GYM_ROUGH],
    robots: [
      {
        robotSlug: "unitree-go2",
        robotName: "Unitree Go2",
        compatibility: {
          status: "compatible",
          actionSpaceMatch: true,
          controlFrequencyMatch: true,
        },
        environments: [
          {
            environmentId: "env-isaac-gym-flat",
            result: {
              successRate: 99,
              episodes: 10000,
              videoUrl: "https://www.youtube.com/embed/jbBfMOuNpMY",
              failureModes: ["Near-perfect on flat terrain"],
            },
          },
          {
            environmentId: "env-isaac-gym-rough",
            result: {
              successRate: 87,
              episodes: 5000,
              failureModes: ["Stumbles on steep slopes > 30 degrees", "Gaps wider than 25cm cause falls"],
            },
          },
        ],
      },
      {
        robotSlug: "unitree-h1",
        robotName: "Unitree H1",
        compatibility: {
          status: "partial",
          actionSpaceMatch: false,
          controlFrequencyMatch: true,
          reason: "H1 has 19 DoF vs Go2's 12. Policy would need morphology adaptation layer.",
        },
        environments: [
          {
            environmentId: "env-isaac-gym-flat",
            result: {
              successRate: 45,
              episodes: 500,
              failureModes: ["Bipedal gait unstable with quadruped policy", "Falls frequently during turns"],
              notes: "Experimental adaptation. Not recommended for deployment.",
            },
          },
          { environmentId: "env-isaac-gym-rough" },
        ],
      },
      {
        robotSlug: "franka-panda",
        robotName: "Franka Panda",
        compatibility: {
          status: "incompatible",
          actionSpaceMatch: false,
          controlFrequencyMatch: false,
          reason: "Franka is a fixed-base arm. This is a locomotion policy for legged robots.",
        },
        environments: [],
      },
    ],
  },
}
