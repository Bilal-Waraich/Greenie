/**
 * The pixel sprites exported from the Figma file (src/assets/sprites), and which one each action shows
 * on the Log screen. Actions without their own sprite in Figma use the leaf; a key added to
 * actions.json later also gets the leaf, so no code change is needed.
 */
import bag from '../assets/sprites/bag.svg'
import bottle from '../assets/sprites/bottle.svg'
import bus from '../assets/sprites/bus.svg'
import can from '../assets/sprites/can.svg'
import check from '../assets/sprites/check.svg'
import coin from '../assets/sprites/coin.svg'
import cup from '../assets/sprites/cup.svg'
import flame from '../assets/sprites/flame.svg'
import leaf from '../assets/sprites/leaf.svg'
import leafLight from '../assets/sprites/leaf-light.svg'
import paper from '../assets/sprites/paper.svg'
import plus from '../assets/sprites/plus.svg'
import salad from '../assets/sprites/salad.svg'
import sceneryDesktop from '../assets/sprites/scenery-desktop.svg'
import sceneryMobile from '../assets/sprites/scenery-mobile.svg'
import sceneryPanel from '../assets/sprites/scenery-panel.svg'
import tabGuide from '../assets/sprites/tab-guide.svg'
import tabGuideActive from '../assets/sprites/tab-guide-active.svg'
import tabHome from '../assets/sprites/tab-home.svg'
import tabHomeActive from '../assets/sprites/tab-home-active.svg'
import tabLeaderboard from '../assets/sprites/tab-leaderboard.svg'
import tabLeaderboardActive from '../assets/sprites/tab-leaderboard-active.svg'
import tabLog from '../assets/sprites/tab-log.svg'
import tabLogActive from '../assets/sprites/tab-log-active.svg'
import tag from '../assets/sprites/tag.svg'

export const SPRITES = {
  check, coin, flame, leaf, leafLight, plus, sceneryDesktop, sceneryMobile, sceneryPanel,
  tabs: {
    home: { idle: tabHome, active: tabHomeActive },
    log: { idle: tabLog, active: tabLogActive },
    leaderboard: { idle: tabLeaderboard, active: tabLeaderboardActive },
    guide: { idle: tabGuide, active: tabGuideActive },
  },
}

/** Sprite per action key, for the 8 actions that have one in Figma. */
const ACTION_SPRITES = {
  recycle_bottle: bottle,
  recycle_can: can,
  recycle_paper: paper,
  reusable_cup: cup,
  reusable_bag: bag,
  plant_meal: salad,
  green_commute: bus,
  second_hand: tag,
}

/**
 * The sprite for an action on the Log screen.
 * @param {string} actionKey
 * @returns {string} Image URL.
 */
export function actionSprite(actionKey) {
  return ACTION_SPRITES[actionKey] ?? leaf
}
