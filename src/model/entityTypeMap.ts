export enum Entity {
    FUNDAMENTAL_TYPE = 'fundamentalType',
    STOCK = 'stock',
    DATA_DATE = 'dataDate',
    DATA_END_DATE = 'dataEndDate',
}

export enum EntityType {
    STRING = 'string',
    /**
     * TIMEX is a format that represents DateTime expressions that include some ambiguity. e.g. missing a Year.
     * It is represented as string TS type
     */
    TIMEX = 'timex',
    NUMBER = 'number',
}

export interface EntityInfo {
    type: EntityType;
}

export const EntityTypeMap: Record<Entity, EntityInfo> = {
    [Entity.FUNDAMENTAL_TYPE]: {
        type: EntityType.STRING,
    },
    [Entity.STOCK]: {
        type: EntityType.STRING,
    },
    [Entity.DATA_DATE]: {
        type: EntityType.TIMEX,
    },
    [Entity.DATA_END_DATE]: {
        type: EntityType.TIMEX,
    },
};
