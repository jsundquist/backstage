/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Entity,
  CompoundEntityRef,
  DEFAULT_NAMESPACE,
  parseEntityRef,
  isUserEntity,
  isGroupEntity,
} from '@backstage/catalog-model';
import React, { forwardRef, useEffect } from 'react';
import { entityRouteRef } from '../../routes';
import { humanizeEntityRef } from './humanize';
import { Link, LinkProps, Progress } from '@backstage/core-components';
import { useApiHolder, useRouteRef } from '@backstage/core-plugin-api';
import {
  Button,
  Tooltip,
  Typography,
  CardContent,
  Card,
  CardActions,
  makeStyles,
  Box,
  Chip,
} from '@material-ui/core';
import {
  usePopupState,
  bindPopover,
  bindHover,
  PopupState,
} from 'material-ui-popup-state/hooks';
import HoverPopover from 'material-ui-popup-state/HoverPopover';
import EmailIcon from '@material-ui/icons/Email';
import InfoIcon from '@material-ui/icons/Info';
import { catalogApiRef } from '../../api';
import { Alert, Skeleton } from '@material-ui/lab';
import useAsyncFn from 'react-use/lib/useAsyncFn';

/**
 * Props for {@link EntityRefLink}.
 *
 * @public
 */
export type EntityRefLinkProps = {
  entityRef: Entity | CompoundEntityRef | string;
  defaultKind?: string;
  title?: string;
  children?: React.ReactNode;
} & Omit<LinkProps, 'to'>;

type PeekAheadPopoverProps = {
  popupState: PopupState;
  entityRef: CompoundEntityRef;
};

const useStyles = makeStyles(() => {
  return {
    popoverPaper: {
      width: '30em',
    },
    descriptionTypography: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: '-webkit-box',
      WebkitLineClamp: 2,
      WebkitBoxOrient: 'vertical',
    },
  };
});

const maxTagChips = 4;

export const PeekAheadPopover = ({
  popupState,
  entityRef,
}: PeekAheadPopoverProps) => {
  const entityRoute = useRouteRef(entityRouteRef);
  const classes = useStyles();
  const apiHolder = useApiHolder();

  const [{ loading, error, value: entity }, load] = useAsyncFn(async () => {
    const catalogApi = apiHolder.get(catalogApiRef);
    if (catalogApi) {
      const retrievedEntity = await catalogApi.getEntityByRef(entityRef);
      if (!retrievedEntity) {
        throw new Error(`${entityRef.name} was not found`);
      }
      return retrievedEntity;
    }
    return undefined;
  }, [apiHolder, entityRef]);

  useEffect(() => {
    if (popupState.isOpen && !entity && !error && !loading) {
      load();
    }
  }, [popupState.isOpen, load, entity, error, loading]);

  return (
    <HoverPopover
      PaperProps={{
        className: classes.popoverPaper,
      }}
      {...bindPopover(popupState)}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'center',
      }}
    >
      <Card>
        {loading && <Progress />}
        <CardContent>
          <Typography color="textSecondary">{entityRef.namespace}</Typography>
          <Typography variant="h5" component="div">
            {entityRef.name}
          </Typography>
          {error && <Alert severity="warning">{error.message}</Alert>}
          {entity ? (
            <>
              <Typography color="textSecondary">{entity.kind}</Typography>
              <Typography className={classes.descriptionTypography} paragraph>
                {entity.metadata.description}
              </Typography>
              <Typography>{entity.spec?.type}</Typography>
              <Box marginTop="0.5em">
                {(entity.metadata.tags || []).slice(0, maxTagChips).map(tag => {
                  return <Chip size="small" label={tag} />;
                })}
                {entity.metadata.tags?.length &&
                  entity.metadata.tags?.length > maxTagChips && (
                    <Tooltip title="Drill into the entity to see all of the tags.">
                      <Chip size="small" label="..." />
                    </Tooltip>
                  )}
              </Box>
            </>
          ) : (
            <>
              <Skeleton width="30%" variant="text" />
              <Skeleton variant="text" />
              <Skeleton width="50%" variant="text" />
              <Skeleton width="20%" variant="text" />
            </>
          )}
        </CardContent>
        <CardActions>
          {entity &&
            (isUserEntity(entity) || isGroupEntity(entity)) &&
            entity.spec.profile?.email && (
              <Tooltip title={`Email ${entity.spec.profile.email}`}>
                <Button
                  target="_blank"
                  href={`mailto:${entity.spec.profile.email}`}
                  size="small"
                >
                  <EmailIcon color="action" />
                </Button>
              </Tooltip>
            )}
          <Tooltip title="Show details">
            <Link component="button" to={entityRoute(entityRef)}>
              <InfoIcon color="action" />
            </Link>
          </Tooltip>
        </CardActions>
      </Card>
    </HoverPopover>
  );
};
/**
 * Shows a clickable link to an entity.
 *
 * @public
 */
export const EntityRefLink = forwardRef<any, EntityRefLinkProps>(
  (props, ref) => {
    const { entityRef, defaultKind, title, children, ...linkProps } = props;
    const entityRoute = useRouteRef(entityRouteRef);
    const popupState = usePopupState({
      variant: 'popover',
      popupId: 'entity-peek-ahead',
    });

    let kind;
    let namespace;
    let name;

    if (typeof entityRef === 'string') {
      const parsed = parseEntityRef(entityRef);
      kind = parsed.kind;
      namespace = parsed.namespace;
      name = parsed.name;
    } else if ('metadata' in entityRef) {
      kind = entityRef.kind;
      namespace = entityRef.metadata.namespace;
      name = entityRef.metadata.name;
    } else {
      kind = entityRef.kind;
      namespace = entityRef.namespace;
      name = entityRef.name;
    }

    kind = kind.toLocaleLowerCase('en-US');
    namespace = namespace?.toLocaleLowerCase('en-US') ?? DEFAULT_NAMESPACE;

    const routeParams = { kind, namespace, name };
    const formattedEntityRefTitle = humanizeEntityRef(
      { kind, namespace, name },
      { defaultKind },
    );

    return (
      <>
        <Link
          {...bindHover(popupState)}
          {...linkProps}
          ref={ref}
          to={entityRoute(routeParams)}
        >
          {children}
          {!children && (title ?? formattedEntityRefTitle)}
        </Link>

        <PeekAheadPopover
          popupState={popupState}
          entityRef={{ kind, namespace, name }}
        />
      </>
    );
  },
) as (props: EntityRefLinkProps) => JSX.Element;
