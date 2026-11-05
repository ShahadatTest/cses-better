export interface RoadmapSection { name: string; problemIds: string[] }
export const zcoRoadmap = {
  id: 'zco-olympiads',
  name: 'ZCO Olympiads',
  description: 'CSES Algorithmic Roadmap for ZCO/ZIO',
  sections: [
    { name: 'Sorting and Searching', problemIds: '1621 1084 1090 1091 1619 1629 1640 1643 1074 2183 2216 2217 1073 1163 2162 2163 2168 2169 1164 1620 1631 1630 1641 1642 1645 1660 1661 1662 2428 1085 1076 1077 1632'.split(' ') },
    { name: 'Dynamic Programming', problemIds: '1633 1634 1635 1636 1637 1638 1158 1746 2413 1639 1744 1745 1097 1093 1145'.split(' ') },
    { name: 'Graph Algorithms', problemIds: '1192 1193 1666 1667 1668 1669 1194 1671 1672 1673 1195 1197 1196 1678 1679 1680 1681 1202 1750 1683'.split(' ') },
    { name: 'Range Queries', problemIds: '1646 1647 1648 1649 1650 1651 1652 1143 1749 1144 1735 1737'.split(' ') },
  ] satisfies RoadmapSection[],
};
